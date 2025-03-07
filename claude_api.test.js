const claudeAPI = require('./claude_api');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('sharp');

describe('Claude API', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true for screenshot paths
    fs.existsSync.mockImplementation(path => path.includes('screenshot'));
    
    // Mock fs.readFileSync to return a buffer
    fs.readFileSync.mockReturnValue(Buffer.from('mock-image-data'));
    
    // Mock sharp functions
    const mockSharp = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image-data')),
      metadata: jest.fn().mockResolvedValue({ width: 1000, height: 800 })
    };
    sharp.mockReturnValue(mockSharp);
  });
  
  test('should optimize screenshots correctly', async () => {
    // Create a large buffer to test compression
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    
    // Test the optimizeScreenshot method
    const result = await claudeAPI.optimizeScreenshot(largeBuffer);
    
    // Verify sharp was called with the buffer
    expect(sharp).toHaveBeenCalledWith(largeBuffer);
    
    // Verify resize was called for large images
    const mockSharpInstance = sharp.mock.results[0].value;
    expect(mockSharpInstance.resize).toHaveBeenCalled();
    expect(mockSharpInstance.jpeg).toHaveBeenCalled();
    
    // Verify the result is a base64 string
    expect(typeof result).toBe('string');
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock checkServerStatus to return true
    claudeAPI.checkServerStatus = jest.fn().mockResolvedValue(true);
    
    // Mock axios.post to throw an error
    const axios = require('axios');
    axios.post.mockRejectedValue(new Error('API error'));
    
    // Call the method and expect it to throw
    await expect(claudeAPI.sendMessageWithScreenshot(
      'system prompt',
      'user message',
      'screenshot.png'
    )).rejects.toThrow('Failed to get response');
    
    // Verify error handling
    expect(axios.post).toHaveBeenCalled();
  });
});
