import { Client } from '@elastic/elasticsearch';

async function run() {
  const client = new Client({
    node: 'http://localhost:9200',
    auth: { username: 'elastic', password: 'changeme' },
    tls: { rejectUnauthorized: false },
  });

  const mapping = await client.indices.getMapping({ index: 'applications' });
  console.log(JSON.stringify(mapping, null, 2));
}

run().catch(console.error);
