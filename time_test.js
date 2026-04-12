const http = require('http');

console.time('fetchPatients');
http.get('http://localhost:3000/api/pacientes?page=1&limit=10', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.timeEnd('fetchPatients');
    console.log(data);
  });
});
