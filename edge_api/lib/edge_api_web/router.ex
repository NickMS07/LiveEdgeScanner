defmodule EdgeApiWeb.Router do
  use EdgeApiWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug, origin: ["http://localhost:3000", "https://live-edge-scanner.vercel.app"]
  end

  scope "/api", EdgeApiWeb do
    pipe_through :api

    # Odds ingestion (scrapers POST here)
    post "/odds/ingest", OddsController, :ingest

    # Query endpoints
    get "/odds/:game_id", OddsController, :show
    get "/edges", OddsController, :edges
    get "/edges/:sport", OddsController, :edges_by_sport
  end
end
