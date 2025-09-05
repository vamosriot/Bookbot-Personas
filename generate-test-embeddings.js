/**
 * Simple script to generate test embeddings using the Cloudflare Worker
 * This will create embeddings for a few Harry Potter books to test the vector search
 */

const CLOUDFLARE_WORKER_URL = 'https://bookbot-openai-worker.vojtech-gryc.workers.dev/';

// Test books to generate embeddings for
const testBooks = [
  { id: 1, title: 'Harry Potter a Kámen mudrců' },
  { id: 2, title: 'Harry Potter a Tajemná komnata' },
  { id: 3, title: 'Harry Potter a vězeň z Azkabanu' },
  { id: 4, title: 'Harry Potter a Ohnivý pohár' },
  { id: 5, title: 'Harry Potter a Fénixův řád' }
];

async function generateEmbedding(text) {
  try {
    console.log(`🔮 Generating embedding for: "${text}"`);
    
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'embedding',
        text: text,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Embedding generation failed: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    
    if (embedding && Array.isArray(embedding)) {
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } else {
      console.warn('❌ Invalid embedding response format');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting test embedding generation...');
  console.log(`📋 Will generate embeddings for ${testBooks.length} test books`);
  
  for (const book of testBooks) {
    const embedding = await generateEmbedding(book.title);
    
    if (embedding) {
      console.log(`📊 Book ID ${book.id}: "${book.title}" -> ${embedding.length} dimensions`);
      
      // You would insert this into your database here
      // For now, just show the SQL you'd need to run:
      console.log(`💾 SQL to insert: INSERT INTO book_embeddings (book_id, embedding, model) VALUES (${book.id}, '[${embedding.join(',')}]', 'text-embedding-3-small');`);
    } else {
      console.log(`❌ Failed to generate embedding for book ID ${book.id}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Test embedding generation complete!');
  console.log('📋 Next steps:');
  console.log('1. Run the SQL INSERT statements above in your Supabase SQL Editor');
  console.log('2. Test the Harry Potter search again');
  console.log('3. You should see vector search results!');
}

main().catch(console.error);
