import json
from pathlib import Path

data = json.loads(
    Path(
        r"C:\Users\rentk\.cursor\projects\c-Users-rentk-Desktop-Edublast\canvases\_tables_data.json"
    ).read_text(encoding="utf-8")
)
tables_literal = json.dumps(data["tables"], ensure_ascii=False, indent=2)
stats_literal = json.dumps(data["stats"], ensure_ascii=False, indent=2)
domains_literal = json.dumps(data["domains"], ensure_ascii=False, indent=2)

canvas = f"""import {{
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
}} from "cursor/canvas";

type TableRow = {{ t: string; d: string; p: string; r: number }};
type DomainStat = {{ domain: string; tables: number; rows: number }};

const DOMAINS: string[] = {domains_literal};

const DOMAIN_STATS: DomainStat[] = {stats_literal};

const TABLES: TableRow[] = {tables_literal};

const TOTAL_TABLES = {data["totalTables"]};
const TOTAL_ROWS = {data["totalRows"]};

export default function TestBeeTableCatalog() {{
  const [domain, setDomain] = useCanvasState<string>("domain", "All");
  const [query, setQuery] = useCanvasState<string>("query", "");

  const filtered = TABLES.filter((row) => {{
    if (domain !== "All" && row.d !== domain) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.t.toLowerCase().includes(q) ||
      row.p.toLowerCase().includes(q) ||
      row.d.toLowerCase().includes(q)
    );
  }});

  const filteredRows = filtered.reduce((sum, row) => sum + row.r, 0);

  return (
    <Stack gap={{20}}>
      <Stack gap={{6}}>
        <H1>TestBee Supabase Catalog</H1>
        <Text tone="secondary">
          Investor data map for project bytsiknhtcnlxwzgqkrd (public schema). Every
          table listed with a one-line purpose. TestBee RAG excluded.
        </Text>
      </Stack>

      <Grid columns={{4}} gap={{12}}>
        <Stat value={{String(TOTAL_TABLES)}} label="Public tables" />
        <Stat value={{TOTAL_ROWS.toLocaleString()}} label="Live rows (approx)" />
        <Stat value={{String(DOMAINS.length)}} label="Product domains" />
        <Stat value="RLS on" label="Security posture" tone="success" />
      </Grid>

      <Callout tone="info" title="How to read this">
        Filter by domain or search by table name. Row counts are live approximate
        counts from Postgres. Purposes are written for diligence — business
        meaning, not column specs.
      </Callout>

      <Card>
        <CardHeader>Coverage by domain</CardHeader>
        <CardBody>
          <Table
            headers={{["Domain", "Tables", "Live rows"]}}
            columnAlign={{["left", "right", "right"]}}
            rows={{DOMAIN_STATS.map((s) => [
              s.domain,
              String(s.tables),
              s.rows.toLocaleString(),
            ])}}
          />
        </CardBody>
      </Card>

      <Divider />

      <H2>All tables</H2>
      <Row gap={{12}} align="center" wrap>
        <Select
          value={{domain}}
          onChange={{setDomain}}
          options={{[
            {{ label: `All domains (${{TOTAL_TABLES}})`, value: "All" }},
            ...DOMAINS.map((d) => ({{
              label: `${{d}} (${{DOMAIN_STATS.find((s) => s.domain === d)?.tables ?? 0}})`,
              value: d,
            }})),
          ]}}
        />
        <TextInput
          value={{query}}
          onChange={{setQuery}}
          placeholder="Search table or purpose…"
        />
        <Pill tone="neutral">
          {{filtered.length}} shown · {{filteredRows.toLocaleString()}} rows
        </Pill>
      </Row>

      <Spacer size={{4}} />

      <Table
        headers={{["#", "Domain", "Table", "Purpose", "Rows"]}}
        columnAlign={{["right", "left", "left", "left", "right"]}}
        rows={{filtered.map((row, i) => [
          String(i + 1),
          row.d,
          row.t,
          row.p,
          row.r.toLocaleString(),
        ])}}
      />

      <Text tone="tertiary" size="small">
        Source: Supabase TestBee · public schema · catalog generated Aug 2026 ·
        Excel twin: TestBee_Supabase_Table_Catalog_Investor.xlsx
      </Text>
    </Stack>
  );
}}
"""

out = Path(
    r"C:\Users\rentk\.cursor\projects\c-Users-rentk-Desktop-Edublast\canvases\testbee-supabase-table-catalog.canvas.tsx"
)
out.write_text(canvas, encoding="utf-8")
print("wrote", out, "chars", len(canvas))

helper = Path(
    r"C:\Users\rentk\.cursor\projects\c-Users-rentk-Desktop-Edublast\canvases\_tables_data.json"
)
helper.unlink(missing_ok=True)
print("cleaned helper json")
