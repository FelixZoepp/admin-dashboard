import next from "eslint-config-next";

export default [
  ...next(),
  {
    ignores: ["supabase/functions/**", ".next/**", "node_modules/**"],
  },
];
