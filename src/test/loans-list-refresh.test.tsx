import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { LoansList } from "@/components/LoansList";

const database = vi.hoisted(() => ({
  loadClients: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => database.loadClients(),
        eq: () => ({ order: async () => ({ data: [], error: null }) }),
      }),
    }),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("preserves loan amounts and installments while the client list refreshes", async () => {
  const clients = [{
    id: "client-1", full_name: "Cliente Teste", cpf: "12345678901",
    rg: "123", address: "Rua Teste", phone: null, identity_photo_path: null,
  }];
  database.loadClients.mockResolvedValueOnce({ data: clients, error: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (refreshKey: number) => (
    <QueryClientProvider client={queryClient}>
      <LoansList refreshKey={refreshKey} />
    </QueryClientProvider>
  );
  const { rerender } = render(view(0));
  fireEvent.click(await screen.findByText("Cliente Teste"));
  fireEvent.click(await screen.findByRole("button", { name: /Novo Empréstimo/i }));
  const inputs = screen.getAllByRole("spinbutton");
  fireEvent.change(inputs[0], { target: { value: "10000" } });
  fireEvent.change(inputs[1], { target: { value: "3" } });
  fireEvent.change(inputs[2], { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar Parcela/i }));
  fireEvent.change(screen.getAllByRole("spinbutton")[3], { target: { value: "5000" } });

  let finishRefresh: (value: { data: typeof clients; error: null }) => void = () => {};
  database.loadClients.mockImplementationOnce(() => new Promise((resolve) => {
    finishRefresh = resolve;
  }));
  rerender(view(1));
  await waitFor(() => expect(database.loadClients).toHaveBeenCalledTimes(2));
  expect(screen.getAllByRole("spinbutton").map(input => (input as HTMLInputElement).value))
    .toEqual(["10000", "3", "2", "5000"]);

  finishRefresh({ data: clients, error: null });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(screen.getAllByRole("spinbutton").map(input => (input as HTMLInputElement).value))
    .toEqual(["10000", "3", "2", "5000"]);
  queryClient.clear();
});