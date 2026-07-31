import Link from "next/link";

type Props = {
  action: string;
  employees: { id: string; fullName: string }[];
  defaultEmployeeId?: string;
  defaultFrom?: string;
  defaultTo?: string;
};

// Plain GET form — filter state lives entirely in the URL's query string, so
// the result table (rendered by the Server Component page at `action`) can
// read it straight from `searchParams`. No client JS needed. Shared between
// the manager (own direct reports) and admin (company-wide) attendance
// history views, which differ only in `employees` and `action`.
export function AttendanceFilters({
  action,
  employees,
  defaultEmployeeId,
  defaultFrom,
  defaultTo,
}: Props) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeId" className="text-foreground-muted">
          Employee
        </label>
        <select
          id="employeeId"
          name="employeeId"
          defaultValue={defaultEmployeeId ?? ""}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="">All</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="from" className="text-foreground-muted">
          From
        </label>
        <input
          type="date"
          id="from"
          name="from"
          defaultValue={defaultFrom}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="to" className="text-foreground-muted">
          To
        </label>
        <input
          type="date"
          id="to"
          name="to"
          defaultValue={defaultTo}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
      >
        Filter
      </button>
      {(defaultEmployeeId || defaultFrom || defaultTo) && (
        <Link href={action} className="px-1 py-1.5 font-medium text-primary hover:underline">
          Clear
        </Link>
      )}
    </form>
  );
}
