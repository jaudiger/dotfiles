{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "supermd";
  version = "e153cca96a9defea46872f9a7e980008ef6c8cdb";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "supermd";
    rev = version;
    hash = "sha256-N3VUvrEJ0qiTipt8u9Zxfolr9f65HYkz20NEMppx26A=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "SuperMD is an extension of Markdown used by https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
