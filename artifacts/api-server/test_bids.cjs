const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const res = await pool.query(
      'INSERT INTO bids (id, buyer_id, product_name, product_image, quantity, unit_type, budget, description, selected_sellers, all_sellers, end_time, media_images, media_videos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      [
        'bid_test_123',
        'user_1784902401599',
        'Test Product',
        'http://image.url',
        42,
        'carton',
        0,
        'Description',
        JSON.stringify(["ch_1786121280879"]),
        true,
        '2026-08-08T15:07:56.976Z',
        JSON.stringify(["http://image.url"]),
        JSON.stringify([])
      ]
    );
    console.log('Insert success');
  } catch(e) {
    console.log('Error message:', e.message);
    console.log('Error detail:', e.detail);
    console.log('Error code:', e.code);
  } finally {
    pool.end();
  }
}
test();
