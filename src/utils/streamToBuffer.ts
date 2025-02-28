export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
  
      stream.on('data', (data: unknown) => {
        if (typeof data === 'string') {
          // Convert string to Buffer assuming UTF-8 encoding
          chunks.push(Buffer.from(data, 'utf-8'));
        } else if (Buffer.isBuffer(data)) {
          chunks.push(data);
        } else {
          // Convert other data types to JSON and then to a Buffer
          try {
            const jsonData = JSON.stringify(data);
            chunks.push(Buffer.from(jsonData, 'utf-8'));
          } catch (error) {
            reject(error);
          }
        }
      });
  
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
  