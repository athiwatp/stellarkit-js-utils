const StellarSdk = require('stellar-sdk')
import axios from 'axios'

export default class StellarAPI {
  constructor(serverAPIServer) {
    if (!serverAPIServer) {
      console.log('StellarAPI constructor missing parameter')
    }

    this._serverAPIServer = serverAPIServer
  }

  server() {
    return this._serverAPIServer.server()
  }

  serverURL() {
    return this._serverAPIServer.serverURL()
  }

  horizonMetrics() {
    const url = this.serverURL() + '/metrics'

    return new Promise((resolve, reject) => {
      axios.get(url)
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  accountInfo(publicKey) {
    return this.server().loadAccount(publicKey)
  }

  balances(publicKey) {
    return new Promise((resolve, reject) => {
      this.server().loadAccount(publicKey)
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const result = {}

          account.balances.forEach((balance) => {
            if (balance.asset_type === 'native') {
              result['XLM'] = balance.balance
            } else {
              result[balance.asset_code] = balance.balance
            }
          })

          return result
        })
        .then((result) => {
          resolve(result)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  mergeAccount(sourceSecret, destKey) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.accountMerge({
              destination: destKey
            }))
            .build()

          transaction.sign(sourceKeys)
          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  manageOffer(sourceSecret, buying, selling, amount, price, offerID = 0) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.manageOffer({
              selling: selling,
              buying: buying,
              amount: amount,
              price: price,
              offerId: offerID
            }))
            .build()

          transaction.sign(sourceKeys)
          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  changeTrust(sourceSecret, asset, limit) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.changeTrust({
              asset: asset,
              limit: limit
            }))
            .build()

          transaction.sign(sourceKeys)

          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  allowTrust(sourceSecret, trustor, asset, authorize) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.allowTrust({
              trustor: trustor,
              assetCode: asset.getCode(),
              authorize: authorize
            }))
            .build()

          transaction.sign(sourceKeys)

          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  makeMultiSig(sourceSecret, publicKey) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.setOptions({
              signer: {
                ed25519PublicKey: publicKey,
                weight: 1
              }
            }))
            .addOperation(StellarSdk.Operation.setOptions({
              masterWeight: 1, // set master key weight
              lowThreshold: 1,
              medThreshold: 2, // a payment is medium threshold
              highThreshold: 2 // make sure to have enough weight to add up to the high threshold!
            }))
            .build()

          transaction.sign(sourceKeys)

          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  sendAsset(sourceSecret, destKey, amount, asset = null, memo = null, additionalSigners = null) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(destKey)
        .catch((error) => {
          reject(error)
        })
        .then(() => {
          return this.server().loadAccount(sourceKeys.publicKey())
        })
        .then((sourceAccount) => {
          let builder = new StellarSdk.TransactionBuilder(sourceAccount)
            .addOperation(StellarSdk.Operation.payment({
              destination: destKey,
              asset: asset === null ? StellarSdk.Asset.native() : asset,
              amount: amount
            }))

          if (memo) {
            builder = builder.addMemo(StellarSdk.Memo.text(memo))
          }

          const transaction = builder.build()

          transaction.sign(sourceKeys)

          if (additionalSigners) {
            for (const signerKey of additionalSigners) {
              transaction.sign(StellarSdk.Keypair.fromSecret(signerKey))
            }
          }

          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  hasAssetTrustline(account, asset) {
    let trusted = false
    trusted = account.balances.some((balance) => {
      return balance.asset_code === asset.getCode() &&
        balance.asset_issuer === asset.getIssuer()
    })

    return trusted
  }

  buyTokens(sourceSecret, sendAsset, destAsset, sendMax, destAmount) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          if (this.hasAssetTrustline(account, destAsset)) {
            const transaction = new StellarSdk.TransactionBuilder(account).addOperation(
                StellarSdk.Operation.pathPayment({
                  destination: sourceKeys.publicKey(),
                  sendAsset: sendAsset,
                  sendMax: sendMax,
                  destAsset: destAsset,
                  destAmount: destAmount,
                  path: []
                })
              )
              .build()

            transaction.sign(sourceKeys)

            return this.server().submitTransaction(transaction)
          } else {
            reject('No trustline from buyer to asset')
          }
        }).then((response) => {
          resolve(response)
        }).catch((error) => {
          reject(error)
        })
    })
  }

  lockAccount(sourceSecret) {
    const options = {
      masterWeight: 0, // set master key weight to zero
      lowThreshold: 1,
      medThreshold: 1,
      highThreshold: 1
    }

    return this.setOptions(sourceSecret, options)
  }

  setDomain(sourceSecret, domain) {
    const options = {
      homeDomain: domain
    }

    return this.setOptions(sourceSecret, options)
  }

  getFlags(publicKey) {
    return new Promise((resolve, reject) => {
      this.server().loadAccount(publicKey)
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          let result = 0

          if (account.flags.auth_required) {
            result |= StellarSdk.AuthRequiredFlag
          }
          if (account.flags.auth_revocable) {
            result |= StellarSdk.AuthRevocableFlag
          }

          resolve(result)
        })
    })
  }

  setFlags(sourceSecret, flags) {
    const options = {
      setFlags: flags
    }

    return this.setOptions(sourceSecret, options)
  }

  clearFlags(sourceSecret, flags) {
    const options = {
      clearFlags: flags
    }

    return this.setOptions(sourceSecret, options)
  }

  setInflationDestination(sourceSecret, inflationDest) {
    const options = {
      inflationDest: inflationDest
    }

    return this.setOptions(sourceSecret, options)
  }

  createAccount(sourceSecret, destinationKey, startingBalance) {
    const options = {
      destination: destinationKey,
      startingBalance: startingBalance
    }

    return this.setOptions(sourceSecret, options)
  }

  setOptions(sourceSecret, options) {
    return new Promise((resolve, reject) => {
      const sourceKeys = StellarSdk.Keypair.fromSecret(sourceSecret)

      this.server().loadAccount(sourceKeys.publicKey())
        .catch((error) => {
          reject(error)
        })
        .then((account) => {
          const transaction = new StellarSdk.TransactionBuilder(account)
            .addOperation(StellarSdk.Operation.setOptions(options))
            .build()

          transaction.sign(sourceKeys)

          return this.server().submitTransaction(transaction)
        })
        .then((response) => {
          resolve(response)
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}
