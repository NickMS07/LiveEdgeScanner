defmodule EdgeApi.EdgeCalculator do
  @moduledoc """
  GenServer that runs the edge detection engine on a schedule.

  Every 30 seconds it reads the full OddsCache, compares Polymarket
  and Kalshi prices against DraftKings / FanDuel / BetMGM "fair value",
  and broadcasts any edges above threshold to all WebSocket subscribers.

  Platforms compared:
    Prediction markets: Polymarket, Kalshi
    Sportsbooks:        DraftKings, FanDuel, BetMGM
  """
  use GenServer
  require Logger

  @edge_threshold   5   # cents
  @calc_interval    30_000  # ms

  # ── Client API ──────────────────────────────────────────

  def start_link(_opts), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  def run_now, do: GenServer.cast(__MODULE__, :run)

  # ── Server ──────────────────────────────────────────────

  @impl true
  def init(state) do
    schedule_calc()
    {:ok, state}
  end

  @impl true
  def handle_cast(:run, state) do
    do_calc()
    {:noreply, state}
  end

  @impl true
  def handle_info(:calc, state) do
    do_calc()
    schedule_calc()
    {:noreply, state}
  end

  defp schedule_calc, do: Process.send_after(self(), :calc, @calc_interval)

  defp do_calc do
    Logger.info("[EdgeCalculator] Running edge scan…")

    EdgeApi.OddsCache.all_games()
    |> Enum.each(fn {_id, game} ->
      case compute_edge(game) do
        {:edge, edge} when edge.edge_cents >= @edge_threshold ->
          updated = %{game | edge: edge}
          EdgeApi.OddsCache.store_game(updated)

          Phoenix.PubSub.broadcast(EdgeApi.PubSub, "edges:all",     {:new_edge, updated})
          Phoenix.PubSub.broadcast(EdgeApi.PubSub, "edges:#{game.sport}", {:new_edge, updated})

          Logger.info("  EDGE #{game.game_id} → +#{edge.edge_cents}¢ (#{edge.confidence})")

        _ -> :ok
      end
    end)
  end

  # ── Edge Computation ─────────────────────────────────────

  defp compute_edge(%{sources: sources} = game) when map_size(sources) < 2, do: {:no_edge, nil}

  defp compute_edge(%{sources: sources} = game) do
    # Average sportsbook prices as the "efficient market" fair value
    sportsbooks = [:draftkings, :fanduel, :betmgm]
    sb_home_prices =
      sportsbooks
      |> Enum.map(&Map.get(sources, to_string(&1)))
      |> Enum.reject(&is_nil/1)
      |> Enum.map(& &1.home)

    # Prediction market sources — use both if available, Polymarket as primary
    pm = Map.get(sources, "polymarket") || Map.get(sources, "kalshi")

    if pm && length(sb_home_prices) > 0 do
      fair_home = Enum.sum(sb_home_prices) / length(sb_home_prices)
      fair_away = 1.0 - fair_home

      home_edge = round((fair_home - pm.home) * 100)
      away_edge = round((fair_away - pm.away) * 100)

      edge = cond do
        home_edge >= @edge_threshold ->
          %{side: "home", team: game.home, polymarket_price: pm.home,
            fair_value: Float.round(fair_home, 3), edge_cents: home_edge,
            confidence: confidence_level(home_edge)}

        away_edge >= @edge_threshold ->
          %{side: "away", team: game.away, polymarket_price: pm.away,
            fair_value: Float.round(fair_away, 3), edge_cents: away_edge,
            confidence: confidence_level(away_edge)}

        true -> nil
      end

      if edge, do: {:edge, edge}, else: {:no_edge, nil}
    else
      {:no_edge, nil}
    end
  end

  defp confidence_level(c) when c >= 10, do: :high
  defp confidence_level(c) when c >= 6,  do: :medium
  defp confidence_level(_),               do: :low
end
