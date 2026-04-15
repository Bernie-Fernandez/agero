require("dotenv").config({ path: ".env" });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(
  "SELECT questions FROM induction_templates WHERE type = 'generic' AND is_active = true LIMIT 1",
  (err, res) => {
    if (err) { console.error(err.message); process.exit(1); }
    const questions = res.rows[0].questions;
    questions.forEach((q, i) => {
      const ca = q.correctAnswers;
      const isArray = Array.isArray(ca);
      const len = isArray ? ca.length : "N/A";
      const multi = isArray && ca.length > 1;
      console.log(
        `Q${i+1}: correctAnswers=${JSON.stringify(ca)} | isArray=${isArray} | length=${len} | multi=${multi} | typeof=${typeof ca}`
      );
    });
    pool.end();
  }
);
