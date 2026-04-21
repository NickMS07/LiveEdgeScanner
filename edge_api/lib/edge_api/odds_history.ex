defmodule EdgeApi.OddsHistory do
  @moduledoc """
  Persists every ingested odds snapshot to PostgreSQL for historical analysis.
  The in-memory ETS cache (OddsCache) is the source of truth for live data;
  this module handles durable storage.
  """
  use Ecto.Schema
  import Ecto.Query
  alias EdgeApi.Repo

  schema "odds_history" do
    field :game_id,    :string
    field :sport,      :string
    field :home,       :string
    field :away,       :string
    field :source,     :string
    field :home_odds,  :float
    field :away_odds,  :float
    field :edge_cents, :integer
    field :confidence, :string
    timestamps(type: :utc_datetime)
  end

  @doc "Record a fresh odds snapshot — called from OddsController after each ingest"
  def record(params) do
    %__MODULE__{}
    |> Ecto.Changeset.cast(params, [:game_id, :sport, :home, :away, :source, :home_odds, :away_odds])
    |> Ecto.Changeset.validate_required([:game_id, :source, :home_odds, :away_odds])
    |> Repo.insert()
  end

  @doc "Fetch odds history for a specific game across all sources"
  def for_game(game_id, limit \\ 100) do
    from(o in __MODULE__,
      where: o.game_id == ^game_id,
      order_by: [desc: o.inserted_at],
      limit: ^limit
    ) |> Repo.all()
  end

  @doc "Fetch recent edges above a threshold"
  def recent_edges(min_cents \\ 5, hours \\ 24) do
    cutoff = DateTime.add(DateTime.utc_now(), -hours * 3600, :second)
    from(o in __MODULE__,
      where: o.inserted_at >= ^cutoff and o.edge_cents >= ^min_cents,
      order_by: [desc: o.edge_cents],
      limit: 200
    ) |> Repo.all()
  end
end
