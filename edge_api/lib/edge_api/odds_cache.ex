defmodule EdgeApi.OddsCache do
  use GenServer

  @table :odds_cache
  @edge_threshold 5

  def start_link(_opts), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  def get_game(game_id) do
    case :ets.lookup(@table, game_id) do
      [{^game_id, data}] -> {:ok, data}
      [] -> {:error, :not_found}
    end
  end

  def all_games do
    :ets.tab2list(@table) |> Map.new()
  end

  def store_game(game), do: :ets.insert(@table, {game.game_id, game})

  def get_edges(min_edge \\ @edge_threshold) do
    :ets.foldl(fn {_k, game}, acc ->
      case game do
        %{edge: %{edge_cents: c}} when c >= min_edge -> [game | acc]
        _ -> acc
      end
    end, [], @table)
    |> Enum.sort_by(& &1.edge.edge_cents, :desc)
  end

  def get_by_sport(sport) do
    :ets.foldl(fn {_k, game}, acc ->
      if game.sport == sport, do: [game | acc], else: acc
    end, [], @table)
  end

  def ingest_odds(game_id, source, odds_data) do
    GenServer.cast(__MODULE__, {:ingest, game_id, source, odds_data})
  end

  @impl true
  def init(_) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:ingest, game_id, source, odds_data}, state) do
    game = case :ets.lookup(@table, game_id) do
      [{^game_id, existing}] -> existing
      [] -> %{game_id: game_id, sport: odds_data[:sport] || "unknown",
              home: odds_data[:home], away: odds_data[:away], sources: %{}, edge: nil}
    end

    updated_sources = Map.put(game.sources, source, %{
      home: odds_data[:home_odds], away: odds_data[:away_odds], updated_at: DateTime.utc_now()
    })

    updated_game = %{game | sources: updated_sources} |> calculate_edge()
    :ets.insert(@table, {game_id, updated_game})

    if updated_game.edge && updated_game.edge.edge_cents >= @edge_threshold do
      Phoenix.PubSub.broadcast(EdgeApi.PubSub, "edges:all", {:new_edge, updated_game})
      Phoenix.PubSub.broadcast(EdgeApi.PubSub, "edges:#{updated_game.sport}", {:new_edge, updated_game})
    end

    {:noreply, state}
  end

  defp calculate_edge(%{sources: sources} = game) when map_size(sources) < 2, do: %{game | edge: nil}
  defp calculate_edge(%{sources: sources} = game) do
    sb_prices = sources |> Map.take(["draftkings","fanduel","betmgm"]) |> Map.values() |> Enum.map(& &1.home)
    pm = Map.get(sources, "polymarket") || Map.get(sources, "kalshi")
    if pm && length(sb_prices) > 0 do
      fair_home = Enum.sum(sb_prices) / length(sb_prices)
      fair_away = 1.0 - fair_home
      home_edge = round((fair_home - pm.home) * 100)
      away_edge = round((fair_away - pm.away) * 100)
      edge = cond do
        home_edge >= @edge_threshold ->
          %{side: "home", team: game.home, polymarket_price: pm.home,
            fair_value: Float.round(fair_home, 3), edge_cents: home_edge, confidence: conf(home_edge)}
        away_edge >= @edge_threshold ->
          %{side: "away", team: game.away, polymarket_price: pm.away,
            fair_value: Float.round(fair_away, 3), edge_cents: away_edge, confidence: conf(away_edge)}
        true -> nil
      end
      %{game | edge: edge}
    else
      %{game | edge: nil}
    end
  end

  defp conf(c) when c >= 10, do: :high
  defp conf(c) when c >= 6,  do: :medium
  defp conf(_),               do: :low
end
