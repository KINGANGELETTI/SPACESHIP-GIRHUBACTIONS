# SPACESHIP-GIRHUBACTIONS
TESTING FOR GITHUB GITHUB ACTIONS TO UPLOAD WEBSITE AUTOMATICALLY TO SPACESHIP.COM WEBSITE 

## FTP Deployment Setup

This repository uses GitHub Actions to automatically deploy files to Spaceship.com via FTP whenever changes are pushed to the `main` branch.

### Required Repository Secrets

Add the following secrets in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `FTP_SERVER` | FTP server hostname (e.g. `ftp.yourdomain.com`) |
| `FTP_USERNAME` | FTP account username |
| `FTP_PASSWORD` | FTP account password |
