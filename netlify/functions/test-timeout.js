exports.handler = async (event) => {
  const start = Date.now();
  
  // Wait for specified seconds
  const waitSeconds = parseInt(event.queryStringParameters?.wait || '40');
  await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
  
  const elapsed = (Date.now() - start) / 1000;
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Waited ${elapsed} seconds successfully!`,
      requestedWait: waitSeconds,
      actualWait: elapsed
    })
  };
};
