{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          terraform
          terragrunt

          # TODO: to re-enable once the build issue is resolved
          # terraform-docs
          tflint

          # For formatting HCL files
          hclfmt
        ];
      };
    };

    host.shell.aliases = {
      # Terraform
      tf = "terraform";
      tfi = "terraform init";
      tfp = "terraform plan";
      tfa = "terraform apply";
      tfd = "terraform destroy";

      # Terragrunt
      tg = "terragrunt";
      tgi = "terragrunt init --terragrunt-source-update --terragrunt-working-dir";
      tga = "terragrunt apply --terragrunt-working-dir";
      tgd = "terragrunt destroy --terragrunt-working-dir";
    };
  };
}
