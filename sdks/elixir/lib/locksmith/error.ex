defmodule Locksmith.Error do
  defexception [:code, :message, :status]

  @impl true
  def exception(opts), do: struct(__MODULE__, opts)
end
