{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "48c3d2285d6c95bbcfb4055c8c84a2c1079fb2aa";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = version;
    hash = "sha256-CaYo2r7PT+Nc1jyhL0Uq9Sgafg+k9VP9JJpEUe7j0nE=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
