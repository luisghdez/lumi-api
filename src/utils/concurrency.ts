/**
 * Utility functions for managing concurrency and parallel processing
 */

/**
 * Process items in batches with controlled concurrency
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param concurrency Maximum number of concurrent operations
 * @returns Promise resolving to array of results
 */
export async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map((item, batchIndex) => 
      processor(item, i + batchIndex)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    console.log(`✅ Processed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(items.length / concurrency)}`);
  }
  
  return results;
}

/**
 * Process items in chunks with specified batch size
 * @param items Array of items to process
 * @param processor Function to process each batch
 * @param batchSize Size of each batch
 * @returns Promise resolving to flattened array of results
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (batch: T[], batchIndex: number) => Promise<R[]>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    
    console.log(`Processing batch ${batchIndex + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);
    
    const batchResults = await processor(batch, batchIndex);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Execute multiple async operations in parallel with timeout
 * @param operations Array of async operations
 * @param timeout Timeout in milliseconds
 * @returns Promise resolving to array of results
 */
export async function parallelWithTimeout<T>(
  operations: (() => Promise<T>)[],
  timeout: number = 30000
): Promise<T[]> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Operations timed out after ${timeout}ms`)), timeout)
  );

  return Promise.race([
    Promise.all(operations.map(op => op())),
    timeoutPromise
  ]);
}

/**
 * Retry an async operation with exponential backoff
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds
 * @returns Promise resolving to operation result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
