defmodule EdgeApiWeb.OddsController do
  @moduledoc """
  REST API endpoints for odds ingestion and querying.
  
  Endpoints:
  - POST /api/odds/ingest    — Scrapers push odds here
  - GET  /api/odds/:game_id  — Get odds for a specific game
  - GET  /api/edges          — Get all current edges
  - GET  /api/edges/:sport   — Get edges for a sport
  """
  use EdgeApiWeb, :controller

  @scraper_api_key System.get_env("SCRAPER_API_KEY", "dev-key-change-me")

  # ── Odds Ingestion (from scrapers) ──────────────────────

  @doc """
  POST /api/odds/ingest
  
  Body:
  {
    "game_id": "nba-lal-hou-2026-04-18",
    "source": "polymarket",
    "sport": "nba",
    "home": "LAL",
    "away": "HOU",
    "home_odds": 0.34,
    "away_odds": 0.67,
    "api_key": "secret"
  }
  """
  def ingest(conn, params) do
    with :ok <- verify_api_key(params["api_key"]),
         :ok <- validate_odds(params) do

      EdgeApi.OddsCache.ingest_odds(
        params["game_id"],
        params["source"],
        %{
          sport: params["sport"],
          home: params["home"],
          away: params["away"],
          home_odds: params["home_odds"],
          away_odds: params["away_odds"]
        }
      )

      # Also persist to database for historical analysis
      EdgeApi.OddsHistory.record(params)

      conn
      |> put_status(:ok)
      |> json(%{status: "ok", game_id: params["game_id"]})
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Invalid API key"})

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{error: reason})
    end
  end

  # ── Query Endpoints ─────────────────────────────────────

  @doc "GET /api/odds/:game_id"
  def show(conn, %{"game_id" => game_id}) do
    case EdgeApi.OddsCache.get_game(game_id) do
      {:ok, game} ->
        json(conn, %{data: format_game(game)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Game not found"})
    end
  end

  @doc "GET /api/edges"
  def edges(conn, params) do
    min_edge = String.to_integer(params["min_edge"] || "5")
    edges = EdgeApi.OddsCache.get_edges(min_edge)

    json(conn, %{
      data: Enum.map(edges, &format_game/1),
      count: length(edges),
      threshold: min_edge
    })
  end

  @doc "GET /api/edges/:sport"
  def edges_by_sport(conn, %{"sport" => sport} = params) do
    min_edge = String.to_integer(params["min_edge"] || "5")

    edges = EdgeApi.OddsCache.get_edges(min_edge)
            |> Enum.filter(& &1.sport == sport)

    json(conn, %{
      data: Enum.map(edges, &format_game/1),
      count: length(edges),
      sport: sport,
      threshold: min_edge
    })
  end

  # ── Private ─────────────────────────────────────────────

  defp verify_api_key(key) when key == @scraper_api_key, do: :ok
  defp verify_api_key(_), do: {:error, :unauthorized}

  defp validate_odds(%{"game_id" => _, "source" => _, "home_odds" => h, "away_odds" => a})
       when is_number(h) and is_number(a) and h >= 0 and a >= 0, do: :ok
  defp validate_odds(_), do: {:error, "Missing or invalid fields"}

  defp format_game(game) do
    %{
      game_id: game.game_id,
      sport: game.sport,
      home: game.home,
      away: game.away,
      edge: game.edge,
      sources: Enum.map(game.sources, fn {source, data} ->
        %{
          source: source,
          home_odds: data.home,
          away_odds: data.away,
          updated_at: data.updated_at
        }
      end)
    }
  end
end
