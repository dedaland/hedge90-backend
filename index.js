import express from 'express';
import redis from 'redis';
import { Web3 } from 'web3';
import { contract_abi } from './contract_abi.js'
import { promisify } from 'util';
import axios from 'axios'

const app = express();
const port = 3000;

// Create a Redis client
const redisClient = redis.createClient();

redisClient.connect()

redisClient.on('connect', function() {
    console.log('Redis client connected');
});

redisClient.on('error', function (err) {
    console.error('Something went wrong with Redis: ' + err);
});

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545');
// https://bsc-testnet.g.allthatnode.com/full/evm/e545c6a0498443ba942cd4c99408bf1e

const contractAddress = '0x5d4fC96A0f39182d8e1ECe4Dd006f9Da839B2Bea';

const account = '0x2f5EF555ce682CB3F88623cC628b67fF0C4e90bD';

// The private key of the account (never share this or hardcode it in production)
const privateKey = '7a9169a72b7b8b820ae23451a58959996557cf6f363b78bf3aa8e8a8aaed47e3';


const fetchData = async () => {
    try {
        const response = await axios.get("https://api.dedabit.co/v1/market");
        const data = response.data['data'];
        for(let item of data){
            if(item.coin === "deda"){
                const value = await redisClient.get('deda-price');
                if(value != item.value || value === null){
                    console.log("Updating price")
                    await redisClient.set('deda-price', item.value);
                    await updateBlockchainPrice(Number(item.value))
                }else{
                    console.log("Price is not changed")
                }
            }
        }
      } catch (error) {
        console.error('Error calling the API:', error);
        throw error;
      }
    };

const updateBlockchainPrice = async (price) => {
    try{
        console.log("data type", typeof price, price, price * (10**6))
        const contract = new web3.eth.Contract(contract_abi, contractAddress);
        const method  = contract.methods.setTokenPrice(price * (10**6));
        const gas = await method.estimateGas({ from: account });
        const gasPrice = await web3.eth.getGasPrice()
        const data = method.encodeABI();
        const tx = {
            from: account,
            to: contractAddress,
            gas,
            gasPrice,
            data
          };
          const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
          web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on('receipt', (receipt) => {
                console.log('Transaction successful with receipt: ', receipt);
            })
            .on('error', (error) => {
                console.error('Transaction failed with error: ', error);
            });
    } catch (error){
        console.error('Error on updating price', error);
    }
};


// Fetch data every x (10 sec)

setInterval(async () => {
    await fetchData();
  }, 10000);


app.get('/get-price', async (req, res) => {
  try {
    console.log('Received request for /get-price');
    const reply = await redisClient.get('deda-price');
    if (reply) {
      console.log('Data retrieved from Redis:', reply);
      res.json({ "price": Number(reply) });
    } else {
      console.log('Data not available yet');
      res.status(503).send('Data not available yet. Please try again later.');
    }
  } catch (err) {
    console.error('Error retrieving data from Redis:', err);
    res.status(500).send('Error retrieving data from Redis');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

