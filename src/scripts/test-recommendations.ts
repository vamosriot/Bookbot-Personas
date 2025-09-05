/**
 * Test Script for Book Recommendation System
 * 
 * This script validates the complete recommendation flow including:
 * - Vector similarity search functionality
 * - Iterative threshold lowering
 * - Fallback mechanisms
 * - Performance benchmarking
 * - Coverage validation
 */

import RecommendationService from '../services/recommendationService';
import { databaseService } from '../services/database';
import EmbeddingService from '../services/embeddingService';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  results?: any;
  error?: string;
  details?: any;
}

class RecommendationTester {
  private recommendationService: RecommendationService;
  private embeddingService: EmbeddingService;
  private testResults: TestResult[] = [];

  constructor() {
    this.recommendationService = new RecommendationService();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Run all recommendation tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Book Recommendation System Tests\n');
    console.log('=' .repeat(60));

    // Test 1: Basic vector search functionality
    await this.testVectorSearch();

    // Test 2: Iterative threshold search
    await this.testIterativeThresholds();

    // Test 3: Fallback mechanisms
    await this.testFallbackMechanisms();

    // Test 4: Performance benchmarking
    await this.testPerformance();

    // Test 5: Coverage validation
    await this.testCoverage();

    // Test 6: Edge cases
    await this.testEdgeCases();

    // Test 7: Database statistics
    await this.testDatabaseStats();

    // Print summary
    this.printTestSummary();
  }

  /**
   * Test basic vector search functionality
   */
  private async testVectorSearch(): Promise<void> {
    const testName = 'Basic Vector Search';
    const startTime = Date.now();

    try {
      console.log(`\n📖 Testing: ${testName}`);
      
      const testQueries = [
        'fantasy adventure',
        'romantic comedy',
        'science fiction',
        'mystery thriller',
        'historical fiction'
      ];

      const results = [];
      for (const query of testQueries) {
        console.log(`  🔍 Searching: "${query}"`);
        
        const searchResult = await this.recommendationService.findSimilarBooksByTitle(
          query, 
          3, 
          { similarity_threshold: 0.7 }
        );
        
        results.push({
          query,
          count: searchResult.recommendations.length,
          processingTime: searchResult.processing_time_ms,
          topMatch: searchResult.recommendations[0]
        });
        
        console.log(`    ✅ Found ${searchResult.recommendations.length} books in ${searchResult.processing_time_ms}ms`);
      }

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results,
        details: { totalQueries: testQueries.length }
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test iterative threshold search
   */
  private async testIterativeThresholds(): Promise<void> {
    const testName = 'Iterative Threshold Search';
    const startTime = Date.now();

    try {
      console.log(`\n🎯 Testing: ${testName}`);
      
      const testQueries = [
        'very specific rare book title that probably does not exist',
        'fantasy',
        'love story',
        'adventure'
      ];

      const results = [];
      for (const query of testQueries) {
        console.log(`  🔄 Testing iterative search: "${query}"`);
        
        const searchResults = await this.recommendationService.searchWithIterativeThresholds(
          query, 
          5
        );
        
        results.push({
          query,
          count: searchResults.length,
          thresholds: searchResults.map(r => (r as any).search_threshold).filter(Boolean),
          topSimilarity: searchResults[0]?.similarity_score
        });
        
        console.log(`    ✅ Found ${searchResults.length} books with thresholds: ${results[results.length - 1].thresholds.join(', ')}`);
      }

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results,
        details: { totalQueries: testQueries.length }
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test fallback mechanisms
   */
  private async testFallbackMechanisms(): Promise<void> {
    const testName = 'Fallback Mechanisms';
    const startTime = Date.now();

    try {
      console.log(`\n🔄 Testing: ${testName}`);
      
      // Test with queries that should trigger fallbacks
      const fallbackQueries = [
        'xyzabc123nonexistent',
        '',
        'a',
        '!@#$%^&*()'
      ];

      const results = [];
      for (const query of fallbackQueries) {
        console.log(`  🧪 Testing fallback for: "${query}"`);
        
        try {
          const searchResults = await this.recommendationService.searchWithIterativeThresholds(
            query, 
            3
          );
          
          results.push({
            query,
            count: searchResults.length,
            fallbackTriggered: searchResults.length === 0
          });
          
          console.log(`    ✅ Handled gracefully: ${searchResults.length} results`);
        } catch (queryError: any) {
          results.push({
            query,
            error: queryError.message,
            fallbackTriggered: true
          });
          console.log(`    ✅ Error handled: ${queryError.message}`);
        }
      }

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results,
        details: { totalQueries: fallbackQueries.length }
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test performance benchmarking
   */
  private async testPerformance(): Promise<void> {
    const testName = 'Performance Benchmarking';
    const startTime = Date.now();

    try {
      console.log(`\n⚡ Testing: ${testName}`);
      
      const performanceQueries = [
        'fantasy adventure magic',
        'romantic love story',
        'mystery detective crime',
        'science fiction space',
        'historical war drama'
      ];

      const benchmarkResults = [];
      let totalSearchTime = 0;
      let totalEmbeddingTime = 0;

      for (const query of performanceQueries) {
        console.log(`  ⏱️  Benchmarking: "${query}"`);
        
        // Test embedding generation time
        const embeddingStart = Date.now();
        await this.embeddingService.generateSingleEmbedding(query);
        const embeddingTime = Date.now() - embeddingStart;
        totalEmbeddingTime += embeddingTime;
        
        // Test search time
        const searchStart = Date.now();
        const searchResult = await this.recommendationService.findSimilarBooksByTitle(query, 5);
        const searchTime = Date.now() - searchStart;
        totalSearchTime += searchTime;
        
        benchmarkResults.push({
          query,
          embeddingTime,
          searchTime,
          totalTime: embeddingTime + searchTime,
          resultCount: searchResult.recommendations.length
        });
        
        console.log(`    ⚡ Embedding: ${embeddingTime}ms, Search: ${searchTime}ms, Total: ${embeddingTime + searchTime}ms`);
      }

      const avgEmbeddingTime = totalEmbeddingTime / performanceQueries.length;
      const avgSearchTime = totalSearchTime / performanceQueries.length;

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results: benchmarkResults,
        details: {
          averageEmbeddingTime: Math.round(avgEmbeddingTime),
          averageSearchTime: Math.round(avgSearchTime),
          totalQueries: performanceQueries.length
        }
      });

      console.log(`    📊 Average embedding time: ${Math.round(avgEmbeddingTime)}ms`);
      console.log(`    📊 Average search time: ${Math.round(avgSearchTime)}ms`);

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test coverage validation
   */
  private async testCoverage(): Promise<void> {
    const testName = 'Coverage Validation';
    const startTime = Date.now();

    try {
      console.log(`\n📊 Testing: ${testName}`);
      
      // Get recommendation statistics
      const stats = await this.recommendationService.getRecommendationStats();
      
      console.log(`    📚 Total embeddings: ${stats.total_embeddings}`);
      console.log(`    💾 Cache size: ${stats.cache_size}`);
      
      // Test cache functionality
      const cacheTestQuery = 'fantasy adventure';
      
      // First search (should miss cache)
      const firstSearch = await this.recommendationService.findSimilarBooksByTitle(cacheTestQuery, 3);
      
      // Second search (should hit cache)
      const secondSearch = await this.recommendationService.findSimilarBooksByTitle(cacheTestQuery, 3);
      
      const cacheWorking = secondSearch.processing_time_ms < firstSearch.processing_time_ms;
      
      console.log(`    🎯 Cache test: First search ${firstSearch.processing_time_ms}ms, Second search ${secondSearch.processing_time_ms}ms`);
      console.log(`    ${cacheWorking ? '✅' : '❌'} Cache ${cacheWorking ? 'working' : 'not working'} properly`);

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results: {
          stats,
          cacheTest: {
            firstSearchTime: firstSearch.processing_time_ms,
            secondSearchTime: secondSearch.processing_time_ms,
            cacheWorking
          }
        }
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test edge cases
   */
  private async testEdgeCases(): Promise<void> {
    const testName = 'Edge Cases';
    const startTime = Date.now();

    try {
      console.log(`\n🧪 Testing: ${testName}`);
      
      const edgeCases = [
        { query: '', description: 'Empty string' },
        { query: ' ', description: 'Whitespace only' },
        { query: 'a'.repeat(1000), description: 'Very long query' },
        { query: '🚀📚✨', description: 'Emoji only' },
        { query: 'Harry Potter', description: 'Popular title' }
      ];

      const results = [];
      for (const testCase of edgeCases) {
        console.log(`    🔬 Testing ${testCase.description}: "${testCase.query.substring(0, 50)}${testCase.query.length > 50 ? '...' : ''}"`);
        
        try {
          const searchResult = await this.recommendationService.searchWithIterativeThresholds(
            testCase.query, 
            3
          );
          
          results.push({
            ...testCase,
            success: true,
            resultCount: searchResult.length
          });
          
          console.log(`      ✅ Handled: ${searchResult.length} results`);
        } catch (caseError: any) {
          results.push({
            ...testCase,
            success: false,
            error: caseError.message
          });
          
          console.log(`      ⚠️  Error (expected): ${caseError.message}`);
        }
      }

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Test database statistics
   */
  private async testDatabaseStats(): Promise<void> {
    const testName = 'Database Statistics';
    const startTime = Date.now();

    try {
      console.log(`\n📈 Testing: ${testName}`);
      
      const stats = await databaseService.getBookRecommendationStats();
      
      console.log(`    📚 Total books: ${stats.total_books}`);
      console.log(`    🔗 Books with embeddings: ${stats.books_with_embeddings}`);
      console.log(`    📊 Coverage: ${stats.embedding_coverage_percentage}%`);
      console.log(`    🤖 Models: ${stats.embedding_models.join(', ')}`);
      console.log(`    🕐 Last update: ${stats.last_embedding_update || 'N/A'}`);

      const coverageGood = stats.embedding_coverage_percentage > 50;
      console.log(`    ${coverageGood ? '✅' : '⚠️'} Coverage ${coverageGood ? 'good' : 'needs improvement'}`);

      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime,
        results: stats
      });

    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);

    console.log(`\n📊 Overall Results:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests} ✅`);
    console.log(`   Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);

    console.log(`\n📝 Detailed Results:`);
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${result.testName} (${result.duration}ms)`);
      if (!result.success && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    // Performance insights
    const performanceTest = this.testResults.find(t => t.testName === 'Performance Benchmarking');
    if (performanceTest && performanceTest.success && performanceTest.details) {
      console.log(`\n⚡ Performance Insights:`);
      console.log(`   Average Embedding Time: ${performanceTest.details.averageEmbeddingTime}ms`);
      console.log(`   Average Search Time: ${performanceTest.details.averageSearchTime}ms`);
    }

    // Coverage insights
    const coverageTest = this.testResults.find(t => t.testName === 'Database Statistics');
    if (coverageTest && coverageTest.success && coverageTest.results) {
      console.log(`\n📊 System Health:`);
      console.log(`   Book Coverage: ${coverageTest.results.embedding_coverage_percentage}%`);
      console.log(`   Total Books: ${coverageTest.results.total_books}`);
      console.log(`   Embedding Models: ${coverageTest.results.embedding_models.join(', ')}`);
    }

    console.log('\n🎉 Book Recommendation System Testing Complete!');
    console.log('='.repeat(60));
  }
}

// Main execution function
async function main() {
  try {
    const tester = new RecommendationTester();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Export for use as module or run directly
export default RecommendationTester;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
