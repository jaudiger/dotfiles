{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "zine";
  version = "v0.10.3";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = version;
    hash = "sha256-3d+tCzqwy9HnnFL6NX8bJcU/Emb5tu07CxZLCYWiT5o=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
