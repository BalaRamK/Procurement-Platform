"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type HeaderSearchProps = {
  placeholder: string;
  className?: string;
};

export function HeaderSearch({ placeholder, className = "" }: HeaderSearchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(q);
  }, [q]);

  const updateUrl = useCallback(
    (newQ: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = newQ.trim();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      const query = params.toString();
      router.push(pathname + (query ? `?${query}` : ""), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className={className}>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            updateUrl(value);
          }
        }}
        onBlur={() => updateUrl(value)}
        className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none dark:text-slate-200 dark:placeholder-slate-400"
        aria-label="Search"
      />
    </div>
  );
}
