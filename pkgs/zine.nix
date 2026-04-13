{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "zine";
  version = "6b6e9eff5ae97723b749142935673cf1a5076fe0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = version;
    hash = "sha256-gf5NEcMyRRC6UCj9xPKR8hbEcbFyiEkPTIx7LmPnERQ=";
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
