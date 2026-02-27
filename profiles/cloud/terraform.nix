{ pkgs, ... }:

{
  modules = {
    host.unfreePackages = [ "terraform" ];

    home-manager = {
      home = {
        packages = with pkgs; [
          terraform
          terragrunt

          terraform-docs
          tflint

          # For formatting HCL files
          hclfmt
        ];
      };
    };

    host.shell.aliases = {
      tf = "terraform";
      tg = "terragrunt";
    };
  };
}
