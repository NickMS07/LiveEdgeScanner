defmodule EdgeApiWeb.EdgesChannel do
  @moduledoc """
  WebSocket channel for real-time edge alerts.
  
  Clients subscribe to:
  - "edges:all" — all sports edges
  - "edges:nba" — NBA only
  - "edges:ufc" — UFC only
  - "edges:mlb" — MLB only
  - "edges:nhl" — NHL only
  
  When the OddsCache detects an edge above threshold,
  it broadcasts here and all connected clients get 
  the alert in real-time.
  """
  use EdgeApiWeb, :channel

  @impl true
  def join("edges:" <> sport, _params, socket) do
    # Send current edges on join
    edges = case sport do
      "all" -> EdgeApi.OddsCache.get_edges()
      sport -> EdgeApi.OddsCache.get_edges()
               |> Enum.filter(& &1.sport == sport)
    end

    # Subscribe to PubSub for real-time updates
    topic = "edges:#{sport}"
    Phoenix.PubSub.subscribe(EdgeApi.PubSub, topic)

    {:ok, %{edges: edges, sport: sport}, assign(socket, :sport, sport)}
  end

  @impl true
  def handle_info({:new_edge, game}, socket) do
    push(socket, "edge_alert", %{
      game_id: game.game_id,
      sport: game.sport,
      home: game.home,
      away: game.away,
      edge: %{
        side: game.edge.side,
        team: game.edge.team,
        polymarket_price: game.edge.polymarket_price,
        fair_value: game.edge.fair_value,
        edge_cents: game.edge.edge_cents,
        confidence: game.edge.confidence
      },
      sources: Enum.map(game.sources, fn {source, data} ->
        %{source: source, home: data.home, away: data.away}
      end)
    })

    {:noreply, socket}
  end

  @impl true
  def handle_in("get_edges", %{"min_edge" => min_edge}, socket) do
    edges = EdgeApi.OddsCache.get_edges(min_edge)
    {:reply, {:ok, %{edges: format_edges(edges)}}, socket}
  end

  def handle_in("get_edges", _params, socket) do
    edges = EdgeApi.OddsCache.get_edges()
    {:reply, {:ok, %{edges: format_edges(edges)}}, socket}
  end

  defp format_edges(edges) do
    Enum.map(edges, fn game ->
      %{
        game_id: game.game_id,
        sport: game.sport,
        home: game.home,
        away: game.away,
        edge: game.edge,
        source_count: map_size(game.sources)
      }
    end)
  end
end
