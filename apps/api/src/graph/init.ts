import pg from 'pg';

async function initGraph() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://meridian:meridian@localhost:5432/meridian',
  });
  await client.connect();

  try {
    await client.query("LOAD 'age'");
    await client.query("SET search_path = ag_catalog, '$user', public");
    await client.query("SELECT create_graph('meridian_graph')");
    console.log('Graph "meridian_graph" created.');
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('Graph "meridian_graph" already exists, skipping.');
    } else {
      throw err;
    }
  }

  await client.end();
}

initGraph();
