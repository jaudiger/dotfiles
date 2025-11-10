{ config, pkgs, ... }:

let
  host = config.modules.host;

  gotoolsOverridden = pkgs.gotools.overrideAttrs (old: {
    # It prevents the `bundle` binary from colliding with other `bundle` commands such as the one found in the `ruby` package.
    postInstall = (old.postInstall or "") + ''
      if [ -e "$out/bin/bundle" ]; then
        mv "$out/bin/bundle" "$out/bin/go-bundle"
      fi
    '';
  });
in
{
  # Per GitLab documentation, this is required in order to clone private repositories using Go tools:
  # https://docs.gitlab.com/user/project/use_project_as_go_package/?#authenticate-go-requests-to-private-projects
  sops = {
    # To decrypt the secret: "nix-shell -p sops --run 'sops -d secrets/.netrc'"
    # To encrypt the secret: "nix-shell -p sops --run 'sops -e secrets/.netrc' > secrets/.netrc"
    secrets.netrc = {
      sopsFile = ../../secrets/.netrc;
      format = "binary";

      path = "${host.homeDirectory}/.netrc";
      owner = host.username;
      mode = "0600";
    };
  };

  modules.home-manager = {
    programs.go = {
      enable = true;
    };

    home = {
      packages = with pkgs; [
        delve
        gopls

        gotoolsOverridden
        golangci-lint
        gosec
      ];
    };
  };
}
