# Terraform Workspace Notes

This Terraform stack currently manages shared infrastructure in `project1grupo7`
with fixed resource names such as:

- `gado-postgres`
- `database-url`
- `restaurant-api`
- `gado-frontend`
- `cloud-run-api`

## Canonical workspace

Until further notice, the canonical Terraform workspace for this shared stack is
`dev-ia`.

Before running `terraform plan` or `terraform apply`, verify the active
workspace:

```bash
terraform workspace show
```

If it is not `dev-ia`, switch before making infra changes:

```bash
terraform workspace select dev-ia
```

## Important warning

Do not use `main`, `default`, or any other workspace against this configuration
while these resources continue to use fixed names. Each workspace has its own
state, so using multiple workspaces against shared resource names can cause
Terraform to try to recreate resources that already exist in GCP.

If we want isolated environments again in the future, resource names must be
made workspace-specific before resuming multi-workspace usage.
