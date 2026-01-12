// Test script to verify canvas API functionality
const testCanvasAPI = async () => {
    try {
        console.log('Testing Canvas API...');

        const response = await fetch('http://localhost:3001/api/reports/canvas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Create a performance report for last month',
                userId: '1', // Test user ID
                selectedSourceId: '1234567890', // Test source ID
                conversationHistory: []
            })
        });

        const data = await response.json();
        console.log('Canvas API Response:', data);

        if (response.ok) {
            console.log('✅ Canvas API working correctly');
            console.log('HTML Content Length:', data.htmlContent?.length || 0);
            console.log('Report Type:', data.type);
        } else {
            console.log('❌ Canvas API failed:', data.error);
        }
    } catch (error) {
        console.error('❌ Canvas API test failed:', error);
    }
};

// Run the test
testCanvasAPI();
