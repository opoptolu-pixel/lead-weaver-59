export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Use provided columns or extract from first row
  const headers = columns
    ? columns.map((col) => col.label)
    : Object.keys(data[0]);
  
  const keys = columns
    ? columns.map((col) => col.key)
    : Object.keys(data[0]);

  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.map(escapeCSV).join(","));

  // Add data rows
  data.forEach((row) => {
    const values = keys.map((key) => {
      const value = row[key as string];
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    });
    csvRows.push(values.map(escapeCSV).join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
