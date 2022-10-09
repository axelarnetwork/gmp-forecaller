# General Message Passing Forecaller
The forecaller service for General Message Passing.

# Deployments
## Deploy on Docker
### Prerequisites
OS: Ubuntu

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

```bash
yarn
cd ./terraform/testnet
terraform init
terraform apply
```