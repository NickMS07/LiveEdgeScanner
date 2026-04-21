defmodule EdgeApi.Application do
  @moduledoc """
  OTP Application for Live Edge Scanner API.
  
  Supervision tree:
  - Phoenix Endpoint (HTTP/WebSocket server)
  - Ecto Repo (PostgreSQL connection pool)
  - Redis connection (hot cache)
  - OddsCache GenServer (ETS-backed in-memory odds)
  - EdgeCalculator GenServer (real-time edge detection)
  """
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Database
      EdgeApi.Repo,

      # PubSub for Phoenix Channels
      {Phoenix.PubSub, name: EdgeApi.PubSub},

      # Redis connection for caching
      {Redix, {Application.get_env(:edge_api, :redis_url, "redis://localhost:6379"), [name: :redix]}},

      # In-memory odds cache (ETS-backed GenServer)
      EdgeApi.OddsCache,

      # Edge calculation engine
      EdgeApi.EdgeCalculator,

      # Phoenix HTTP/WebSocket endpoint
      EdgeApiWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: EdgeApi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    EdgeApiWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
