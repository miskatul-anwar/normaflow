/**
 * File Processing Utilities
 * Author: miskatul-anwar
 * Date: 2025-07-30 05:40:38 UTC
 */

export class FileUtils {
  /**
   * Download content as a file
   */
  static downloadAsFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Download JSON data as a file
   */
  static downloadJSON(data: any, filename: string): void {
    const content = JSON.stringify(data, null, 2);
    this.downloadAsFile(content, filename, 'application/json');
  }

  /**
   * Download CSV data as a file
   */
  static downloadCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      throw new Error('No data provided for CSV download');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = (row[header] || '').toString();
          // Escape quotes and wrap in quotes if contains comma or quote
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    this.downloadAsFile(csvContent, filename, 'text/csv');
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      'json': 'application/json',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'sql': 'application/sql',
      'mmd': 'text/plain',
      'html': 'text/html',
      'xml': 'application/xml'
    };

    return mimeTypes[ext || ''] || 'text/plain';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate file type
   */
  static isValidFileType(file: File, allowedTypes: string[]): boolean {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    return allowedTypes.some(type => 
      fileType.includes(type) || fileName.endsWith(`.${type}`)
    );
  }

  /**
   * Read file as text
   */
  static readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Create downloadable URL for content
   */
  static createDownloadURL(content: string, mimeType: string = 'text/plain'): string {
    const blob = new Blob([content], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Generate timestamp for filenames
   */
  static generateTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  /**
   * Generate unique filename
   */
  static generateUniqueFilename(baseName: string, extension: string): string {
    const timestamp = this.generateTimestamp();
    return `${baseName}_${timestamp}.${extension}`;
  }
}