defmodule EdgeApi.Repo.Migrations.CreateOddsHistory do
  use Ecto.Migration

  def change do
    create table(:odds_history) do
      add :game_id,    :string,  null: false
      add :sport,      :string,  null: false
      add :home,       :string,  null: false
      add :away,       :string,  null: false
      add :source,     :string,  null: false
      add :home_odds,  :float,   null: false
      add :away_odds,  :float,   null: false
      add :edge_cents, :integer
      add :confidence, :string
      timestamps(type: :utc_datetime)
    end

    create index(:odds_history, [:game_id])
    create index(:odds_history, [:sport])
    create index(:odds_history, [:source])
    create index(:odds_history, [:inserted_at])
  end
end
