export const config = {
  timeout: 60
};

export const handler = async (event) => {
  const start = Date.now();
  
  // Wait 45 seconds
  await new Promise(resolve => setTimeout(resolve, 45000));
  
  const elapsed = (Date.now() - start) / 1000;
  
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Successfully waited ${elapsed} seconds!`,
      timestamp: new Date().toISOString()
    })
  };
};
