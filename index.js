import express from 'express';
import redis from 'redis';
import { Web3 } from 'web3';
import { contract_abi } from './contract_abi.js'
import axios from 'axios'

const app = express();
const port = 3000;

// Create a Redis client
const redisClient = redis.createClient();

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545');
// https://bsc-testnet.g.allthatnode.com/full/evm/e545c6a0498443ba942cd4c99408bf1e

const contractAddress = '0x5d4fC96A0f39182d8e1ECe4Dd006f9Da839B2Bea';

const contract = new web3.eth.Contract(contract_abi, contractAddress);

const fetchData = async () => {
    try {
        const response = await axios.get("https://api.dedabit.co/v1/market");
        const data = response.data['data'];
        for(let item of data){
            if(item.coin === "deda"){
                console.log("PRICE", item)
            }
        }
      } catch (error) {
        console.error('Error calling the API:', error);
        throw error;
      }
    };

// const fetchData = async () => {
//     try {
//         const data = await contract.methods.methodName().call();
//         console.log('Data fetched from blockchain:', data);

//         redisClient.set('fetchedData', JSON.stringify(data), 'EX', 3600);
//     } catch (error) {
//         console.error('Error fetching data from blockchain:', error);
//     }
// };

// Fetch data every hour (3600000 milliseconds)
setInterval(fetchData, 10 * 1000);

// Initial fetch
fetchData();

// REST endpoint to get the fetched data
app.get('/data', (req, res) => {
    redisClient.get('fetchedData', (err, reply) => {
        if (err) {
            res.status(500).send('Error retrieving data from Redis');
        } else if (reply) {
            res.json(JSON.parse(reply));
        } else {
            res.status(503).send('Data not available yet. Please try again later.');
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

