import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Presentation } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getPreviewMoveCaseUpdatesToBackgroundQueryKey,
  useMoveCaseUpdatesToBackground,
  usePreviewMoveCaseUpdatesToBackground,
} from "@/lib/api/generated/case-updates/case-updates";
import { getListCasesGroupedByClientQueryKey } from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";

export function CaseGlobalActions() {
  const client = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewMoveCaseUpdatesToBackground({
    query: { enabled: confirmOpen },
  });
  const move = useMoveCaseUpdatesToBackground();

  async function confirmMove() {
    setError(null);
    try {
      await move.mutateAsync();
      setConfirmOpen(false);
      void client.invalidateQueries({
        queryKey: getPreviewMoveCaseUpdatesToBackgroundQueryKey(),
      });
      void client.invalidateQueries({
        queryKey: getListCasesGroupedByClientQueryKey(),
      });
      void client.invalidateQueries({
        queryKey: getListDashboardActivityQueryKey(),
      });
      void client.invalidateQueries({
        predicate: ({ queryKey }) =>
          typeof queryKey[0] === "string" &&
          queryKey[0].startsWith("/api/cases/") &&
          queryKey[0].includes("/updates"),
      });
    } catch {
      setError(
        "No pudimos pasar las novedades a antecedentes. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Más acciones de casos"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1" role="menu">
          <Button
            asChild
            variant="ghost"
            size="sm"
            role="menuitem"
            className="w-full justify-start"
          >
            <Link to="/cases/presentation" onClick={() => setMenuOpen(false)}>
              <Presentation aria-hidden="true" />
              Ver presentación
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="menuitem"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false);
              setError(null);
              setConfirmOpen(true);
            }}
          >
            Pasar novedades a antecedentes
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pasar novedades a antecedentes</DialogTitle>
            <DialogDescription>
              {preview.isPending
                ? "Calculando el alcance de la conversión…"
                : preview.isError
                  ? "No pudimos calcular cuántas novedades se modificarán."
                  : preview.data?.movedCount
                    ? `Se convertirán ${preview.data.movedCount} novedades de ${preview.data.caseCount} casos activos del estudio.`
                    : "No hay novedades activas por convertir en los casos activos del estudio."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Los antecedentes seguirán disponibles dentro de cada caso y podrán
            volver a clasificarse individualmente como novedades.
          </p>
          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                preview.isPending ||
                preview.isError ||
                !preview.data?.movedCount ||
                move.isPending
              }
              onClick={() => void confirmMove()}
            >
              Confirmar conversión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
