import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "clients" | "loans" | "installments";

interface UseRealtimeSubscriptionOptions {
  tables: TableName[];
  onDataChange: () => void;
}

export function useRealtimeSubscription({
  tables,
  onDataChange,
}: UseRealtimeSubscriptionOptions) {
  useEffect(() => {
    const channels = tables.map((table) => {
      return supabase
        .channel(`${table}-changes`)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: table,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            console.log(`Realtime update on ${table}:`, payload.eventType);
            onDataChange();
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables, onDataChange]);
}
