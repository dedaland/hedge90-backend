import express from 'express';
import redis from 'redis';
import { Web3 } from 'web3';
import { tokenPriceAbi } from './tokenPriceAbi.js'
import { tokenSaleAbi } from './tokenSaleAbi.js'
import { promisify } from 'util';
import axios from 'axios'
import cors from 'cors'

import 'dotenv/config'

const app = express();
const port = 3000;

app.use(cors())

// Create a Redis client
const redisClient = redis.createClient({ url:'redis://'+process.env.REDIS_URL });

redisClient.connect()

redisClient.on('connect', function() {
    console.log('Redis client connected');
});

redisClient.on('error', function (err) {
    console.error('Something went wrong with Redis: ' + err);
});

const web3 = new Web3(process.env.RPC_URL);
// https://bsc-testnet.g.allthatnode.com/full/evm/e545c6a0498443ba942cd4c99408bf1e

const tokenPriceContractAddress = process.env.TOKEN_PRICE_CONTRACT_ADDRESS;
const tokenSaleContractAddress = process.env.TOKEN_SALE_CONTRACT_ADDRESS;

const account = process.env.ACCOUNT;

// The private key of the account (never share this or hardcode it in production)
const privateKey = process.env.PRIVATE_KEY;




const fetchData = async () => {
    try {
        const response = await axios.get(process.env.PRICE_ENDPOINT);
        const data = response.data['data'];
        for(let item of data){
            if(item.coin === "deda"){
                const value = await redisClient.get('deda-price');
                if(value != item.sell || value === null){
                    console.log("Updating price")
                    await redisClient.set('deda-price', item.sell) //, {EX: 30});
                    await updateBlockchainPrice(Number(item.sell))
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
        const contract = new web3.eth.Contract(tokenPriceAbi, tokenPriceContractAddress);
        const method  = contract.methods.setTokenPrice(price * (10**6));
        const gas = await method.estimateGas({ from: account });
        const gasPrice = await web3.eth.getGasPrice()
        const data = method.encodeABI();
        const tx = {
            from: account,
            to: tokenPriceContractAddress,
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

const stringifyBigIntsInArray = (array) => {
  return array.map(item => {
    const newItem = {};
    for (const key in item) {
      if (typeof item[key] === 'bigint') {
        newItem[key] = item[key].toString();
      } else {
        newItem[key] = item[key];
      }
    }
    return newItem;
  });
};

const fetchUserPurchases = async (address) => {
  try{
    const contract = new web3.eth.Contract(tokenSaleAbi, tokenSaleContractAddress);
    const result = await contract.methods.getPurchases(address).call()
    const stringifiedResult = stringifyBigIntsInArray(result);
    await redisClient.set("purchases-"+address, JSON.stringify(stringifiedResult), {EX: 30});
    console.log('Purchases for ', address, 'stored in Redis');
    return stringifiedResult
  }catch(error){
    console.error('Error fetching or storing purchases:', error);
  }

}


// Fetch data every x (20 sec)

setInterval(async () => {
    await fetchData();
    // await fetchUserPurchases(account)
  }, 20000);


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


app.get('/get-user-purchases/:address', async (req, res) => {
    try {
      console.log('Received request for/get-user-purchases', req.params.address);
      if(req.params.address === "undefined"){
        return res.status(200).send('No address!');
      }
      const userPurchases = await fetchUserPurchases(req.params.address)
      res.json(userPurchases)

    //   const reply = await redisClient.get('deda-price');
    //   if (reply) {
    //     console.log('Data retrieved from Redis:', reply);
    //     res.json({ "price": Number(reply) });
    //     res.json(userPurchases)
    //   } else {
    //     console.log('Data not available yet');
    //     res.status(503).send('Data not available yet. Please try again later.');
    //   }
    // } catch (err) {
    //   console.error('Error retrieving data from Redis:', err);
    //   res.status(500).send('Error retrieving data from Redis');
    // }
  }catch(err){
    console.error("Err", err)
  }
});

  app.get('/set-user-purchases', async (req, res) => {
    try {
      console.log('Received request for /set-user-purchases');
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

