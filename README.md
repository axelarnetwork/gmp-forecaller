# General Message Passing Forecaller
The forecaller service for General Message Passing.

# Deployments
### clone project
```
cd $HOME
git clone https://github.com/axelarnetwork/gmp-forecaller
cd gmp-forecaller
git pull
```

There are 2 options for deployments
- [Docker](#deploy-on-docker)
- [AWS services](#deploy-on-aws-services)

## Deploy on Docker
### Prerequisites
OS: Ubuntu

### install docker
```
curl -fsSL get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo chmod 666 /var/run/docker.sock
```

### configure environment
set your `ENVIRONMENT` in `docker-compose.yml` file
value: `testnet` | `mainnet`
default: `testnet`

### start service
```bash
cd $HOME/gmp-forecaller
docker-compose up --build -d axelar-gmp-forecaller
```
### view log
```bash
cd $HOME/gmp-forecaller
docker-compose logs -f --tail=100 axelar-gmp-forecaller
```
### restart service
```bash
cd $HOME/gmp-forecaller
docker-compose restart axelar-gmp-forecaller
```

## Deploy on AWS services
### Stacks
- AWS Lambda
- AWS EventBridge

### Prerequisites
1. [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-prereqs.html)
2. [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)
3. [Install terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli)

### start service
### Testnet
```bash
yarn
cd ./terraform/testnet
terraform init
terraform apply
```
- open [AWS console](https://console.aws.amazon.com/lambda/home#/functions/axelar-gmp-forecaller-testnet?tab=configure)
- add trigger EventBridge (CloudWatch Events): `axelar-gmp-forecaller-testnet-rule`

### Mainnet
```bash
yarn
cd ./terraform/mainnet
terraform init
terraform apply
```
- open [AWS console](https://console.aws.amazon.com/lambda/home#/functions/axelar-gmp-forecaller-mainnet?tab=configure)
- add trigger EventBridge (CloudWatch Events): `axelar-gmp-forecaller-mainnet-rule`