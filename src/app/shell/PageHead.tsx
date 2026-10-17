import type { ReactNode } from "react";
import type { Page } from "../types";
import { cn } from "@/shared/ui/cn";
import MobileActions from "./MobileActions";
import SectionTabs from "./SectionTabs";
import { pagesOfSection, sectionForPage } from "./navigation";

/** Une seule barre dans le flux, partagée avec le banc visuel : ses commandes
 * doivent tenir AVEC la navigation et les accès mobiles, jamais isolément. */
export default function PageHead({
  page,
  setPage,
  actions,
  lead,
}: {
  page: Page;
  setPage: (page: Page) => void;
  actions: ReactNode;
  lead: ReactNode;
}) {
  const section = sectionForPage(page);
  const hasTabs = section && pagesOfSection(section).length > 1;
  return (
    <div
      className={cn(
        "app-page-head mx-auto flex w-full items-center gap-2 px-4 pt-3 md:gap-3 md:px-6 md:pt-4",
        page === "calendar" ? "max-w-[1400px]" : "max-w-[1200px]",
      )}
    >
      <div
        className={cn(
          "min-w-0 flex-1",
          page === "dashboard" && "md:order-2 md:flex md:justify-end",
        )}
      >
        {hasTabs ? <SectionTabs section={section} page={page} setPage={setPage} /> : lead}
      </div>
      {actions && (
        <div
          className={cn("flex shrink-0 items-center gap-2", page === "dashboard" && "md:order-1")}
        >
          {actions}
        </div>
      )}
      <MobileActions page={page} setPage={setPage} />
    </div>
  );
}
