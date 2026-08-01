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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="employeeId" className="section-label">
          Employee
        </label>
        <select
          id="employeeId"
          name="employeeId"
          defaultValue={defaultEmployeeId ?? ""}
          className="field"
        >
          <option value="">All</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="from" className="section-label">
          From
        </label>
        <input
          type="date"
          id="from"
          name="from"
          defaultValue={defaultFrom}
          className="field font-mono text-[13px]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="to" className="section-label">
          To
        </label>
        <input
          type="date"
          id="to"
          name="to"
          defaultValue={defaultTo}
          className="field font-mono text-[13px]"
        />
      </div>
      <button type="submit" className="btn btn-primary">
        Filter
      </button>
      {(defaultEmployeeId || defaultFrom || defaultTo) && (
        <Link
          href={action}
          className="px-1 py-2 font-medium text-link hover:underline"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
