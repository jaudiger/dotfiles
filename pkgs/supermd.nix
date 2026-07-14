{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation rec {
  pname = "supermd";
  version = "70e34739939e927dcef97288b57d30b24d221497";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = version;
    hash = "sha256-SDkNjhBSIMdMoPJQ/rEcEnG9NQgtpP5djoGJDBd+11U=";
  };

  nativeBuildInputs = [
    zig_master
  ];

  buildPhase = "zig build --global-cache-dir .zig-cache -Doptimize=ReleaseFast";
  installPhase = "install -Dm755 zig-out/bin/docgen -t $out/bin";

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
