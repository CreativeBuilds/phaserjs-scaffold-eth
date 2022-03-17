import ethers from 'ethers';
import fs from 'fs';
// load account from account.txt
// generate if doesnt exist
// and generate a description for the function


/**
 * @returns {Promise<ethers.Signer>}
 * @description returns a signer from the account.txt file
 * generates a new account if account.txt doesnt exist
 */
export async function GetSigner() {
    return new Promise(res => {
        fs.readFile("./account.txt", (err, data) => {
            if(err) {
                console.log("Generating new account...")
                const wallet = ethers.Wallet.createRandom();
                const mnemonic = wallet.mnemonic.phrase;
                fs.writeFile("./account.txt", mnemonic, () => {
                    console.log("Account saved to account.txt")
                })
                return res(wallet);
            }
            else {
                const Signer = ethers.Wallet.fromMnemonic(data.toString());
                return res(Signer);
            }
        })
    })
    
}