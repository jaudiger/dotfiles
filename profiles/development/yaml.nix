{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          yaml-language-server
        ];
      };

      # Neovim configuration
      programs.nixvim = {
        plugins.lsp.servers = {
          yamlls = {
            enable = true;
            settings = {
              yaml = {
                completion = true;
                format = {
                  enable = true;
                };
                hover = true;
                schemaStore = {
                  enable = true;
                };
                schemas = {
                  kubernetes = "**/*.yaml";
                };
                validate = true;
              };
            };
          };
        };
      };
    };
  };
}
