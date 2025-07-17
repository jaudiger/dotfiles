{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          yaml-language-server
        ];
      };

      # Helix configuration
      programs.helix.languages = {
        language-server = {
          yaml-language-server = {
            config = {
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
                  kubernetes = "**.yaml";
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
