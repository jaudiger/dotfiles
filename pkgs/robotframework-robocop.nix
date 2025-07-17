{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  setuptools,
  wheel,
  jinja2,
  robotframework,
  typer,
  rich,
  tomli,
  pathspec,
  platformdirs,
  pytz,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "6.5.0";
  pyproject = true;

  disabled = pythonOlder "3.9";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-7ikGFNiYlcKXkfiM07zwMSGT6NRuPo/iueQXxNTzvqI=";
  };

  nativeBuildInputs = [
    setuptools
    wheel
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer
    rich
    tomli
    pathspec
    platformdirs
    pytz
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
